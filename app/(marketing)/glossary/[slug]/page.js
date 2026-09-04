// app/(marketing)/glossary/[slug]/page.js
//
// One page per term.
//
// ══ Why per-term pages exist, having argued the other way first ════════════
//
// The case against them is real and it is the reason to write this down: a
// hundred pages carrying sixty words each is a thin-content farm, and search
// engines have spent a decade learning to demote exactly that — not just the
// thin pages, the site under them. "It ranks for a competitor" is not a
// defence, because the competitor's pages might be the thing holding them
// back rather than the thing lifting them.
//
// They are here anyway, for two reasons that survive that objection:
//
//   1. THE SEARCH IS PER TERM. Nobody types "contractor glossary". They type
//      "what is a lien waiver" at eleven at night with a letter in their hand.
//      An index page can only rank once; it cannot be the best answer to a
//      hundred different questions at the same time.
//   2. THESE PAGES ARE NOT THIN, and that is enforced rather than intended.
//      Every one carries a definition with a real floor on its length, what
//      the term is also called, which trades use it, the jurisdiction warning
//      where the law varies, a hand-picked set of related terms, and the rest
//      of its section. scripts/check-glossary.mjs fails the build on a
//      definition under the floor, so a future stub entry cannot ship a page.
//
// The duplication objection is answered by the split, not by luck: the index
// prints only the opening sentence, so the full definition exists in exactly
// one place on the site, on this page, which is its own canonical.
//
// ══ Where the links belong — WIRED INTO NOTHING on purpose ═════════════════
//
// Nothing in the global nav points here yet. That is a deliberate hand-off,
// not an oversight, because header and footer are shared surfaces owned
// elsewhere. When somebody wants it linked, the three honest places are:
//
//   * app/components/marketing/MarketingFooter.js — the Resources column,
//     beside footer.links.help and footer.links.contact. Note that column
//     renders LABELS FROM THE CATALOGUE, so a link there needs a
//     footer.links.glossary key in all six languages or check:translations
//     goes red. That is the one place adding this costs translation work.
//   * app/(marketing)/resources/ResourcesContent.js — its CARDS array, as a
//     third card. Same catalogue constraint.
//   * The industry pages' "Also serving nearby trades" strip, if per-trade
//     glossary filtering is ever built. It is not built, so no link is
//     claimed for it here.
//
// Not the header. The header has two dropdowns and four links already, and a
// glossary is a page people arrive at from search, not one they navigate to.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_SLUGS,
  entriesInCategory,
  glossaryEntry,
  openingSentence,
} from "@/app/data/tradeGlossary";
import { marketingMetadata } from "@/lib/marketing/metadata";
import {
  JurisdictionNote,
  ProductNote,
  Synonyms,
  Trades,
} from "../GlossaryBits";

export function generateStaticParams() {
  return GLOSSARY_SLUGS.map((slug) => ({ slug }));
}

// English only, for the reason generateMetadata in the industry pages gives:
// serving a French title to an English crawler because the last visitor
// switched languages is worse than not translating it.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const entry = glossaryEntry(slug);
  if (!entry) return {};

  // The title is the QUESTION somebody typed, not our headword in isolation.
  // "Retainage" competes with a dictionary; "What is retainage?" competes for
  // the search that actually happens.
  return marketingMetadata({
    path: `/glossary/${slug}`,
    title: `What is ${entry.term.toLowerCase()}? | FieldQuo contractor glossary`,
    description: openingSentence(entry.definition),
  });
}

export default async function GlossaryTermPage({ params }) {
  // Next 16: params is a Promise. Reading it synchronously logs a
  // sync-dynamic-apis error on every render.
  const { slug } = await params;
  const entry = glossaryEntry(slug);
  if (!entry) return notFound();

  const category = GLOSSARY_CATEGORIES.find((c) => c.key === entry.category);
  const related = entry.related.map(glossaryEntry).filter(Boolean);
  const siblings = entriesInCategory(entry.category).filter(
    (e) => e.slug !== entry.slug && !entry.related.includes(e.slug),
  );

  return (
    <div>
      <div className="bg-muted border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link
            href="/glossary"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Glossary
          </Link>
          {category && (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {" "}
              / {category.label}
            </span>
          )}
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            {entry.term}
          </h1>
          <div className="mt-3 space-y-1">
            <Synonyms entry={entry} />
            <Trades entry={entry} />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-lg text-foreground leading-relaxed">
          {entry.definition}
        </p>

        <JurisdictionNote entry={entry} />
        <ProductNote entry={entry} />

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-foreground">
              Related terms
            </h2>
            <ul className="mt-4 space-y-px bg-accent border border-border rounded-xl overflow-hidden">
              {related.map((r) => (
                <li key={r.slug} className="bg-card">
                  <Link
                    href={`/glossary/${r.slug}`}
                    className="block p-4 hover:bg-muted"
                  >
                    <span className="font-medium text-foreground">{r.term}</span>
                    <span className="block mt-1 text-sm text-muted-foreground leading-relaxed">
                      {openingSentence(r.definition)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The rest of the section, as names only. A reader who came for one
            word usually wants the two beside it on the same document, and a
            page that dead-ends sends them back to search. */}
        {category && siblings.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-foreground">
              More in {category.label.toLowerCase()}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={`/glossary/${s.slug}`}
                  className="text-sm bg-card border border-border px-4 py-2 rounded-full hover:bg-muted text-foreground"
                >
                  {s.term}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Every document in your name, not ours
          </h2>
          {/* NOT text-muted-foreground. That token is #4d6076 and is picked to
              sit on the light --card and --muted washes; on --primary (#06356b)
              it measures 1.88:1 — grey on navy, and the sentence carrying the
              offer was the least readable thing in the block. /features/[slug]
              already prints its ctaBody as text-primary-foreground/80, which is
              8.31:1 on the same navy, so this matches it rather than inventing
              a third value. scripts/check-marketing-contrast.mjs measures the
              pairing rather than trusting this comment. */}
          <p className="mt-3 text-primary-foreground/80">
            Quotes, invoices and scheduling for field-service businesses. Your
            first month is free — your card isn&apos;t charged until it ends.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-muted"
          >
            Start free trial <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
