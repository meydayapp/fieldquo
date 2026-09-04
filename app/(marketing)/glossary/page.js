// app/(marketing)/glossary/page.js
//
// /glossary — the index. One directory entry per term, grouped the way a job
// happens rather than A to Z.
//
// ══ Why the index shows one sentence and not the whole definition ══════════
//
// The obvious build is to print every definition in full here and let the term
// pages be optional. That produces a page that duplicates a hundred other
// pages word for word, which is the worst of both: a wall of text nobody
// scrolls, and a hundred pages competing with their own index for the same
// query. So the index is a DIRECTORY — headword, what it is also called, and
// the opening sentence — and the term page is where the whole definition, the
// jurisdiction warning and the related words live. The opening sentence is
// derived by openingSentence(), never authored twice; see the note on that
// function for why a hand-written summary field was rejected.
//
// ══ No translation, and that is a decision rather than an omission ═════════
//
// A server component with English copy, reading app/data/tradeGlossary.js. It
// does not use useTranslation, so check:translations does not gate it — the
// same arrangement app/data/productFeatures.js has. What that costs is
// recorded honestly: a French-speaking contractor gets an English glossary
// today. Translating it is not a t() sweep, because half these words have a
// different French term rather than a translated English one, so it belongs
// with the locale-routing work at the end of docs/ROADMAP.md.
//
// This page is linked from nowhere yet. See the header of [slug]/page.js for
// where the links belong once somebody decides to add them.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  GLOSSARY_CATEGORIES,
  TRADE_GLOSSARY,
  entriesInCategory,
  openingSentence,
} from "@/app/data/tradeGlossary";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { Synonyms } from "./GlossaryBits";

export const metadata = marketingMetadata({
  path: "/glossary",
  title: "Contractor glossary — the words on your quotes, explained | FieldQuo",
  description:
    "Plain-English definitions of the terms field-service contractors actually meet — markup and margin, takeoffs, deposits, liens, permits, and the vocabulary of a dozen trades.",
});

export default function GlossaryIndexPage() {
  return (
    <div>
      {/* Hero — same shape as the industry pages, without the video half,
          because a glossary index has nothing to show. */}
      <div className="bg-muted border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Glossary
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            The words on your quotes, explained
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {TRADE_GLOSSARY.length} terms a painter, plumber, roofer or cabinet
            maker actually meets — written for a one-van business rather than
            for a commercial construction manager. Where an answer depends on
            the province or state you work in, we say so instead of picking one.
          </p>
        </div>
      </div>

      {/* Jump links. Nine sections is more than a reader will scroll past. */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap gap-2">
          {GLOSSARY_CATEGORIES.map((cat) => (
            <a
              key={cat.key}
              href={`#${cat.key}`}
              className="text-sm border border-border rounded-full px-4 py-2 text-foreground hover:bg-muted"
            >
              {cat.label}
              <span className="text-muted-foreground">
                {" "}
                ({entriesInCategory(cat.key).length})
              </span>
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {GLOSSARY_CATEGORIES.map((cat) => (
          <section key={cat.key} id={cat.key} className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-foreground">{cat.label}</h2>
            <p className="mt-2 text-muted-foreground">{cat.blurb}</p>

            <ul className="mt-8 space-y-px bg-accent border border-border rounded-xl overflow-hidden">
              {entriesInCategory(cat.key).map((entry) => (
                <li key={entry.slug} className="bg-card">
                  <Link
                    href={`/glossary/${entry.slug}`}
                    className="block p-5 hover:bg-muted"
                  >
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {entry.term}
                      </span>
                      {/* The pill is the whole point of the flag: a reader
                          scanning the index sees which answers are local
                          before they read one and act on it. */}
                      {entry.varies && (
                        <span className="text-xs font-medium border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                          Varies by province / state
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {openingSentence(entry.definition)}
                    </p>
                    <Synonyms entry={entry} className="mt-2" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Closing CTA — the industry pages' one, worded for a reader who came
          here to look up a word rather than to shop. */}
      <div className="bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Quotes, invoices and scheduling in your own name
          </h2>
          {/* NOT text-muted-foreground. That token is #4d6076 and is picked to
              sit on the light --card and --muted washes; on --primary (#06356b)
              it measures 1.88:1 — grey on navy. /features/[slug] already prints
              its ctaBody as text-primary-foreground/80, which is 8.31:1 on the
              same navy, so this matches it rather than inventing a third value.
              scripts/check-marketing-contrast.mjs measures the pairing rather
              than trusting this comment. */}
          <p className="mt-3 text-primary-foreground/80">
            Set up your pricing, send one quote, and see whether it saves you
            the evening. That&apos;s the whole test.
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
