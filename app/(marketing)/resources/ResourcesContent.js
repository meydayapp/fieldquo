// app/(marketing)/resources/ResourcesContent.js
//
// Client half of /resources. Split from page.js so the page can still export
// metadata while the copy renders in the visitor's language.
//
// ── Why the FAQ section was blank ───────────────────────────────────────────
//
// This page mapped FAQS and read `f.q` / `f.a`. app/data/faqs.js carries IDs
// ONLY — the question and answer text lives in the message catalogue under
// faq.items.<id>.q / .a, exactly so adding a language doesn't mean duplicating
// the array. So every field was undefined, six <div>s rendered empty, and the
// React key was `undefined` six times over. The heading sat above nothing.
//
// Rendered expanded rather than as the homepage accordion: someone who
// navigated to a resources page came to read the answers, not to hunt for them
// behind six chevrons.
"use client";

import Link from "next/link";
import { FAQS } from "@/app/data/faqs";
import { useTranslation } from "@/app/hooks/useTranslation";

const CARDS = [
  {
    href: "/resources/help",
    labelKey: "footer.links.help",
    descKey: "resources.help.description",
  },
  {
    href: "/contact",
    labelKey: "footer.links.contact",
    descKey: "resources.contact.description",
  },
];

export default function ResourcesContent() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-8">
        {t("nav.resources")}
      </h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-16">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border border-border rounded-xl p-6 transition-colors hover:border-foreground/40"
          >
            <div className="font-medium text-foreground">
              {t(card.labelKey)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {t(card.descKey)}
            </div>
          </Link>
        ))}
      </div>

      {/* id="faq" is a real target: the homepage resources teaser links here.
          It used to point at /resources/faq, which has never existed. */}
      <h2
        id="faq"
        className="scroll-mt-20 text-xl font-semibold text-foreground mb-6"
      >
        {t("faq.title")}
      </h2>
      <div className="space-y-6">
        {FAQS.map((faq) => (
          <div key={faq.id}>
            <h3 className="font-medium text-foreground">
              {t(`faq.items.${faq.id}.q`)}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {t(`faq.items.${faq.id}.a`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
