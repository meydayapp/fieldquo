// app/components/marketing/home/CustomerStory.js
//
// Section 9: what the people using FieldQuo say — between "why one system"
// and the plans, where the site audit (2026-10-15, D3.2) asked for it.
//
// ══ The two stories today, and why they say who they are ═══════════════════
//
// Both quotes come from businesses connected to FieldQuo's founder:
// TrueFinish Cabinets is Emilio Boves's own company, and Sunset Space is run
// by his family. Endorsement rules (the FTC's Endorsement Guides in the US,
// the Competition Bureau's guidance in Canada) require a material connection
// between an endorser and the seller to be disclosed clearly, next to the
// endorsement. So each one prints its connection in the attribution itself —
// not in a footnote — and the heading turns the connection into what it is:
// FieldQuo ran these businesses before it ran anybody else's. The disclosure
// links to the founder's own account on /about.
//
// ══ How to add one ═══════════════════════════════════════════════════════
//
// Only a story the customer has agreed to, in words they approved, that the
// owner has signed off. Add an entry to CUSTOMER_STORIES:
//
//   {
//     id: "acme-painting-2026",
//     company: "Acme Painting",          // as the customer wants it printed
//     place: "Calgary",                  // optional
//     person: "Jane D.",                 // optional, as they want it printed
//     // The customer's own words, per language THEY approved. Never
//     // machine-translated: a quote is a statement by a real person, and a
//     // translation they did not see is words put in their mouth. Languages
//     // without an entry show the original, marked with its lang.
//     quote: { en: "…" },
//     originalLanguage: "en",
//     // The material connection, or null for an ordinary customer. A key
//     // under home.stories.connection.* — required, so leaving it out is a
//     // decision nobody made.
//     connection: null,
//     approvedBy: "owner name",          // who at FieldQuo signed it off
//     approvedOn: "2026-10-15",          // and when
//   }
//
// No photos unless the customer supplies one. check:homepage-sections fails
// any entry without approvedBy, approvedOn, originalLanguage or connection.
"use client";

import Link from "next/link";
import { Quote, ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export const CUSTOMER_STORIES = [
  {
    id: "truefinish-2026-10",
    company: "TrueFinish Cabinets",
    place: "Ottawa",
    person: "Emilio B.",
    // The owner's words as he supplied them on 2026-10-15, with only the two
    // typos he asked to fix ("hussle" → "hassle", a lower-case "i").
    quote: {
      en: "I have been trying for years to offer financing, with FieldQuo I was able to offer it right after I signed up without any hassle.",
    },
    originalLanguage: "en",
    connection: "founderCompany",
    approvedBy: "Emilio Boves",
    approvedOn: "2026-10-15",
  },
  {
    id: "sunset-space-2026-10",
    company: "Sunset Space",
    place: null,
    person: null,
    quote: {
      en: "Everything is so automated and integrated that I can't imagine what my life was like before FieldQuo.",
    },
    originalLanguage: "en",
    connection: "founderFamily",
    approvedBy: "Emilio Boves",
    approvedOn: "2026-10-15",
  },
];

export default function CustomerStory() {
  const { t, language } = useTranslation();
  const stories = CUSTOMER_STORIES.filter((s) => s.quote?.[language] || s.quote?.[s.originalLanguage]);
  const story = stories[0];
  if (!story) return null;

  return (
    <section className="bg-muted border-t border-border" data-customer-stories>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h2 className="mx-auto max-w-3xl text-center text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
          {t("home.stories.title")}
        </h2>
        <ul className={`mt-10 grid gap-6 ${stories.length > 1 ? "md:grid-cols-2" : "max-w-3xl mx-auto"}`}>
          {stories.map((s) => {
            const own = Boolean(s.quote?.[language]);
            const words = own ? s.quote[language] : s.quote[s.originalLanguage];
            const where = [s.company, s.place ? `(${s.place})` : null].filter(Boolean).join(" ");
            return (
              <li key={s.id}>
                <figure className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <Quote size={28} aria-hidden="true" className="text-brand-accent-text" />
                  <blockquote
                    lang={own ? language : s.originalLanguage}
                    className="mt-4 flex-1 text-xl sm:text-2xl font-semibold leading-snug tracking-tight text-foreground text-pretty"
                  >
                    {words}
                  </blockquote>
                  <figcaption className="mt-6 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {s.person ? `${s.person}, ${where}` : where}
                    </span>
                    {s.connection ? (
                      // The disclosure, in the attribution, every time.
                      <span className="block mt-1" data-story-connection={s.connection}>
                        {t(`home.stories.connection.${s.connection}`)}
                      </span>
                    ) : null}
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
        {stories.some((s) => s.connection) ? (
          <p className="mt-8 text-center">
            <Link
              href="/about#founder"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("home.stories.aboutLink")}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
