// app/(marketing)/product/[slug]/ProductPageContent.js
//
// Client half of the product page. Split from page.js because translation
// lives in React context (needs "use client") while generateStaticParams and
// generateMetadata must stay in a server component.
//
// Before this existed, the whole page was app/data/productFeatures.js rendered
// raw, and the two buttons had "Start Free Trial" and "See Pricing" typed into
// the JSX. Three navigation surfaces link here — MarketingHeader,
// MarketingFooter, and the homepage feature cards — so a French or Ukrainian
// visitor left a fully translated homepage and landed on an English page from
// the main nav.
"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { productPageCopy } from "@/app/data/productFeatures";
import { productSay } from "@/app/i18n/productPages";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ProductPageContent({ slug }) {
  const { t, language } = useTranslation();

  // Two resolvers on purpose, and they are not interchangeable.
  //
  // The prose comes from app/i18n/productPages/, which is NOT merged into
  // MESSAGES — see that directory's index.js for why — so t() cannot see it
  // and productSay() walks the same chain over the same nine modules.
  //
  // The label comes from t(), because `product.<slug>.label` is already in
  // messages.js in all nine languages and the header dropdown, the footer and
  // the homepage band all render it. Copying the word into a second catalogue
  // would be a second wording of it, and the copy nobody looks at is the one
  // that rots.
  const copy = productPageCopy(slug, productSay(language));
  if (!copy) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {t(`product.${slug}.label`, copy.label)}
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">
        {copy.headline}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        {copy.description}
      </p>

      <ul className="mt-8 space-y-3 max-w-xl">
        {copy.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3">
            <CheckCircle2
              size={20}
              className="text-green-600 shrink-0 mt-0.5"
            />
            <span className="text-foreground">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex gap-3">
        {/* Both labels are borrowed rather than written, because both already
            exist in all nine languages and a tenth wording of "Start free
            trial" is a tenth thing to keep in step.

            hero.cta is already shared — Hero and ClosingCTA both render it.

            featurePage.chrome.seePricing is namespaced to /features and used
            here anyway: it is the same button on the same kind of page, and
            duplicating the string into productPages/ would put the same two
            words in two catalogues in nine languages each. It is a SHARED key
            now, not the feature pages' private one — scripts/check-product-
            pages.mjs asserts these pages render it in every language, so
            deleting it with /features fails this build too. */}
        <Link
          href="/signup"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold"
        >
          {t("hero.cta")}
        </Link>
        <Link
          href="/pricing"
          className="border border-border px-6 py-3 rounded-full text-sm font-semibold"
        >
          {t("featurePage.chrome.seePricing")}
        </Link>
      </div>
    </div>
  );
}
