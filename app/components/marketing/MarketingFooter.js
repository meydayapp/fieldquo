// app/components/marketing/MarketingFooter.js
//
// Now a client component. It has to be, because translation lives in React
// context — the alternative is threading the active language down from the
// server, which for a footer isn't worth the complexity.
"use client";

import Link from "next/link";
import { INDUSTRIES } from "@/app/data/industries";
import { useTranslation } from "@/app/hooks/useTranslation";

// Keys + hrefs only. Labels resolve from the catalog under footer.links.*,
// reusing the product.* keys the header already defines rather than
// duplicating the same four strings in six languages twice over.
const FOOTER_COLUMNS = [
  {
    titleKey: "nav.product",
    links: [
      { key: "product.quoting.label", href: "/product/quoting" },
      { key: "product.scheduling.label", href: "/product/scheduling" },
      { key: "product.team.label", href: "/product/team" },
      { key: "product.analytics.label", href: "/product/analytics" },
      { key: "nav.pricing", href: "/pricing" },
    ],
  },
  {
    titleKey: "nav.resources",
    links: [
      { key: "footer.links.help", href: "/resources/help" },
      { key: "footer.links.faq", href: "/resources/faq" },
      { key: "footer.links.blog", href: "/resources/blog" },
      { key: "footer.links.contact", href: "/contact" },
    ],
  },
  {
    titleKey: "footer.company",
    links: [
      { key: "footer.links.about", href: "/about" },
      { key: "footer.links.careers", href: "/careers" },
      { key: "footer.links.privacy", href: "/privacy" },
      { key: "footer.links.terms", href: "/terms" },
    ],
  },
];

export default function MarketingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="bg-primary text-primary-foreground/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <span className="text-xl font-bold text-white tracking-tight">
              FieldQuo
            </span>
            <p className="text-sm text-primary-foreground/80 mt-3 leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Industries column is built from INDUSTRIES rather than the
              catalog — those labels live in app/data/industries.js and are
              still English-only. See the note in the commit. */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">
              {t("nav.industries")}
            </h4>
            <ul className="space-y-2">
              {INDUSTRIES.slice(0, 6).map((ind) => (
                <li key={ind.slug}>
                  <Link
                    href={`/industries/${ind.slug}`}
                    className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
                  >
                    {ind.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.titleKey}>
              <h4 className="text-sm font-semibold text-white mb-3">
                {t(col.titleKey)}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-primary flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-primary-foreground/80">
            © {new Date().getFullYear()} FieldQuo. {t("footer.rights")}
          </p>
          <div className="flex items-center gap-6">
            <a
              href="tel:+18195551234"
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              (819) 555-1234
            </a>
            <Link
              href="/privacy"
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              {t("footer.privacy")}
            </Link>
            <Link
              href="/terms"
              className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
            >
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
